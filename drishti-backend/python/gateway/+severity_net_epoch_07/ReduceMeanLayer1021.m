classdef ReduceMeanLayer1021 < nnet.layer.Layer & nnet.layer.Formattable
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
            name = 'severity_net_epoch_07.coder.ReduceMeanLayer1021';
        end
    end


    methods
        function this = ReduceMeanLayer1021(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_5_53'};
        end

        function [x_blocks_blocks_5_53] = predict(this, x_blocks_blocks_5_47)
            if isdlarray(x_blocks_blocks_5_47)
                x_blocks_blocks_5_47 = stripdims(x_blocks_blocks_5_47);
            end
            x_blocks_blocks_5_47NumDims = 4;
            x_blocks_blocks_5_47 = severity_net_epoch_07.ops.permuteInputVar(x_blocks_blocks_5_47, [4 3 1 2], 4);

            [x_blocks_blocks_5_53, x_blocks_blocks_5_53NumDims] = ReduceMeanGraph1063(this, x_blocks_blocks_5_47, x_blocks_blocks_5_47NumDims, false);
            x_blocks_blocks_5_53 = severity_net_epoch_07.ops.permuteOutputVar(x_blocks_blocks_5_53, [3 4 2 1], 4);

            x_blocks_blocks_5_53 = dlarray(single(x_blocks_blocks_5_53), 'SSCB');
        end

        function [x_blocks_blocks_5_53] = forward(this, x_blocks_blocks_5_47)
            if isdlarray(x_blocks_blocks_5_47)
                x_blocks_blocks_5_47 = stripdims(x_blocks_blocks_5_47);
            end
            x_blocks_blocks_5_47NumDims = 4;
            x_blocks_blocks_5_47 = severity_net_epoch_07.ops.permuteInputVar(x_blocks_blocks_5_47, [4 3 1 2], 4);

            [x_blocks_blocks_5_53, x_blocks_blocks_5_53NumDims] = ReduceMeanGraph1063(this, x_blocks_blocks_5_47, x_blocks_blocks_5_47NumDims, true);
            x_blocks_blocks_5_53 = severity_net_epoch_07.ops.permuteOutputVar(x_blocks_blocks_5_53, [3 4 2 1], 4);

            x_blocks_blocks_5_53 = dlarray(single(x_blocks_blocks_5_53), 'SSCB');
        end

        function [x_blocks_blocks_5_53, x_blocks_blocks_5_53NumDims1065] = ReduceMeanGraph1063(this, x_blocks_blocks_5_47, x_blocks_blocks_5_47NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net_epoch_07.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1064, x_blocks_blocks_5_47NumDims);
            xMean = mean(x_blocks_blocks_5_47, dims);
            x_blocks_blocks_5_53 = xMean;
            x_blocks_blocks_5_53NumDims = x_blocks_blocks_5_47NumDims;

            % Set graph output arguments
            x_blocks_blocks_5_53NumDims1065 = x_blocks_blocks_5_53NumDims;

        end

    end

end