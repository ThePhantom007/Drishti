classdef ReduceMeanLayer1019 < nnet.layer.Layer & nnet.layer.Formattable
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
            name = 'severity_net_epoch_10.coder.ReduceMeanLayer1019';
        end
    end


    methods
        function this = ReduceMeanLayer1019(name)
            this.Name = name;
            this.OutputNames = {'x_blocks_blocks_5_23'};
        end

        function [x_blocks_blocks_5_23] = predict(this, x_blocks_blocks_5_17)
            if isdlarray(x_blocks_blocks_5_17)
                x_blocks_blocks_5_17 = stripdims(x_blocks_blocks_5_17);
            end
            x_blocks_blocks_5_17NumDims = 4;
            x_blocks_blocks_5_17 = severity_net_epoch_10.ops.permuteInputVar(x_blocks_blocks_5_17, [4 3 1 2], 4);

            [x_blocks_blocks_5_23, x_blocks_blocks_5_23NumDims] = ReduceMeanGraph1057(this, x_blocks_blocks_5_17, x_blocks_blocks_5_17NumDims, false);
            x_blocks_blocks_5_23 = severity_net_epoch_10.ops.permuteOutputVar(x_blocks_blocks_5_23, [3 4 2 1], 4);

            x_blocks_blocks_5_23 = dlarray(single(x_blocks_blocks_5_23), 'SSCB');
        end

        function [x_blocks_blocks_5_23] = forward(this, x_blocks_blocks_5_17)
            if isdlarray(x_blocks_blocks_5_17)
                x_blocks_blocks_5_17 = stripdims(x_blocks_blocks_5_17);
            end
            x_blocks_blocks_5_17NumDims = 4;
            x_blocks_blocks_5_17 = severity_net_epoch_10.ops.permuteInputVar(x_blocks_blocks_5_17, [4 3 1 2], 4);

            [x_blocks_blocks_5_23, x_blocks_blocks_5_23NumDims] = ReduceMeanGraph1057(this, x_blocks_blocks_5_17, x_blocks_blocks_5_17NumDims, true);
            x_blocks_blocks_5_23 = severity_net_epoch_10.ops.permuteOutputVar(x_blocks_blocks_5_23, [3 4 2 1], 4);

            x_blocks_blocks_5_23 = dlarray(single(x_blocks_blocks_5_23), 'SSCB');
        end

        function [x_blocks_blocks_5_23, x_blocks_blocks_5_23NumDims1059] = ReduceMeanGraph1057(this, x_blocks_blocks_5_17, x_blocks_blocks_5_17NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims = severity_net_epoch_10.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1058, x_blocks_blocks_5_17NumDims);
            xMean = mean(x_blocks_blocks_5_17, dims);
            x_blocks_blocks_5_23 = xMean;
            x_blocks_blocks_5_23NumDims = x_blocks_blocks_5_17NumDims;

            % Set graph output arguments
            x_blocks_blocks_5_23NumDims1059 = x_blocks_blocks_5_23NumDims;

        end

    end

end