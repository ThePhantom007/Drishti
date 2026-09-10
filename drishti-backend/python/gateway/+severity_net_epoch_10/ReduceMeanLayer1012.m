classdef ReduceMeanLayer1012 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end


    methods(Static, Hidden)
        % Specify the path to the class that will be used for codegen
        function name = matlabCodegenRedirect(~)
            name = 'severity_net_epoch_10.coder.ReduceMeanLayer1012';
        end
    end


    methods
        function this = ReduceMeanLayer1012(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_3_68'};
        end

        function [x_blocks_blocks_3_68] = predict(this, x_blocks_blocks_3_62)
            if isdlarray(x_blocks_blocks_3_62)
                x_blocks_blocks_3_62 = stripdims(x_blocks_blocks_3_62);
            end
            x_blocks_blocks_3_62NumDims = 4;
            x_blocks_blocks_3_62 = severity_net_epoch_10.ops.permuteInputVar(x_blocks_blocks_3_62, [4 3 1 2], 4);

            [x_blocks_blocks_3_68, x_blocks_blocks_3_68NumDims] = ReduceMeanGraph1036(this, x_blocks_blocks_3_62, x_blocks_blocks_3_62NumDims, false);
            x_blocks_blocks_3_68 = severity_net_epoch_10.ops.permuteOutputVar(x_blocks_blocks_3_68, [3 4 2 1], 4);

            x_blocks_blocks_3_68 = dlarray(single(x_blocks_blocks_3_68), 'SSCB');
        end

        function [x_blocks_blocks_3_68] = forward(this, x_blocks_blocks_3_62)
            if isdlarray(x_blocks_blocks_3_62)
                x_blocks_blocks_3_62 = stripdims(x_blocks_blocks_3_62);
            end
            x_blocks_blocks_3_62NumDims = 4;
            x_blocks_blocks_3_62 = severity_net_epoch_10.ops.permuteInputVar(x_blocks_blocks_3_62, [4 3 1 2], 4);

            [x_blocks_blocks_3_68, x_blocks_blocks_3_68NumDims] = ReduceMeanGraph1036(this, x_blocks_blocks_3_62, x_blocks_blocks_3_62NumDims, true);
            x_blocks_blocks_3_68 = severity_net_epoch_10.ops.permuteOutputVar(x_blocks_blocks_3_68, [3 4 2 1], 4);

            x_blocks_blocks_3_68 = dlarray(single(x_blocks_blocks_3_68), 'SSCB');
        end

        function [x_blocks_blocks_3_68, x_blocks_blocks_3_68NumDims1038] = ReduceMeanGraph1036(this, x_blocks_blocks_3_62, x_blocks_blocks_3_62NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net_epoch_10.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1037, x_blocks_blocks_3_62NumDims);
            xMean = mean(x_blocks_blocks_3_62, dims);
            x_blocks_blocks_3_68 = xMean;
            x_blocks_blocks_3_68NumDims = x_blocks_blocks_3_62NumDims;

            % Set graph output arguments
            x_blocks_blocks_3_68NumDims1038 = x_blocks_blocks_3_68NumDims;

        end

    end

end